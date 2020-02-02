import fs from 'fs';
import readline from 'readline';
import {google, gmail_v1} from 'googleapis';
import {OAuth2Client, Credentials} from 'google-auth-library';
import * as credentials from "../credentials.json";
import _ from 'lodash';
import moment, {Moment} from 'moment';
import path from 'path';
import {Printer} from "ipp";
import {appendSuccessEntry, getLastModificationTime} from "./log";
import {json} from "express";

interface TWriteMessageProps {
    messageId: string
    subject: string,
    fileName: string,
    sentDateMmtUtc: Moment;
    pagesRanges: string;
    from: string;
    to: string;
    dataBase64: string
}

interface TAttachmentInfo {
    timeStamp: Moment;
    pagesRanges: string | null;
    reason: string | null;
    sentDateMmtUtc: Moment;
    from: string;
    subject: string,
    fileName: string,
    messageId: string,
    attachmentId: string
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';
const {client_secret, client_id, redirect_uris} = credentials.installed;
const dataDir = './data/';
const attachmentsFileName = 'processed-attachement.json';

const getAuthClientFromToken = (token: Credentials) => {
    const oAuth2Client = new OAuth2Client(
        client_id, client_secret, redirect_uris[0]);

    oAuth2Client.setCredentials(token);

    return oAuth2Client;
};

const readToken = () => new Promise<Credentials>((resolve, reject) => {
    fs.readFile(TOKEN_PATH, (err, savedToken) => {
        if (err) return reject("Error with token");
        const parsedToken: Credentials = JSON.parse(savedToken.toString());
        resolve(parsedToken)
    })
});

const writeToken = (token: Credentials) => new Promise<Credentials>((resolve, reject) => {
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return reject(err);
        console.log('Token stored to', TOKEN_PATH);
        resolve(token);
    });
});

const askUserForCode: () => Promise<string> = () => {
    const oAuth2Client = new OAuth2Client(
        client_id, client_secret, redirect_uris[0]);
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);
    return new Promise<string>((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            resolve(code);
        });
    });
};

const getToken = (code: string) => new Promise<Credentials>((resolve, reject) => {
    const oAuth2Client = new OAuth2Client(
        client_id, client_secret, redirect_uris[0]);
    oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject('Error retrieving access token' + err);
        if (!token) return reject('Token is empty');
        resolve(token);
    })
});

const getGmailApi = async () => {
    const auth = await getSavedOAuthClient();
    return google.gmail({version: 'v1', auth});
};

export const getNewToken: () => Promise<Credentials> = async () => {
    const code = await askUserForCode();
    const token = await getToken(code);

    await writeToken(token);

    return token;
};

const getSavedOAuthClient: () => Promise<OAuth2Client> = async () => {
    const token = await readToken();
    return getAuthClientFromToken(token);
};

export const getTo = (message: gmail_v1.Schema$Message) => {
    const payload = message.payload;
    const headers = payload && payload.headers;
    const subjectHeader = _.filter(headers, {name: "To"}).map(o => o.value);
    return subjectHeader.join(',');
};

export const getFrom = (message: gmail_v1.Schema$Message) => {
    const payload = message.payload;
    const headers = payload && payload.headers;
    const subjectHeader = _.find(headers, {name: "From"});
    return subjectHeader && subjectHeader.value;
};


export const getSubject = (message: gmail_v1.Schema$Message) => {
    const payload = message.payload;
    const headers = payload && payload.headers;
    const subjectHeader = _.find(headers, {name: "Subject"});
    return subjectHeader && subjectHeader.value;
};

export const getSentDateMmtUtc = (message: gmail_v1.Schema$Message) => {
    const payload = message.payload;
    const headers = payload && payload.headers;
    const subjectHeader = _.find(headers, {name: "Date"});
    return subjectHeader && subjectHeader.value && moment.utc(subjectHeader.value);
};

export const findPdfPart = (message: gmail_v1.Schema$Message) => {
    const payload = message.payload;
    const parts = payload && payload.parts;
    return _.find(parts, part => !!part.filename && part.filename.includes('.pdf'));
};

export const getPagesRanges = (subject: string, fileName: string, from: string, to: string) => {
    if (!fileName.toLocaleLowerCase().includes("faktura")) return {
        pagesRanges: null,
        reason: "SUBJECT NOT: faktura"
    };
    if (to.toLocaleLowerCase().includes("infolet.pl")) return {
        pagesRanges: null,
        reason: "TO: infolet.pl"
    };
    if (subject.toLocaleLowerCase().startsWith("re:")) return {
        pagesRanges: null,
        reason: "SUBJECT: re:"
    };
    if (subject.toLocaleLowerCase().startsWith("odp:")) return {
        pagesRanges: null,
        reason: "SUBJECT: odp:"
    };
    return {
        pagesRanges: '1-3',
        reason: null
    };
};

const cfg = {
    debug: true,
    print: false
};

export const log = (prefix: string, attachmentInfo: TAttachmentInfo) => {
    if (cfg.debug) {
        console.log(prefix, attachmentInfo.timeStamp.format(), attachmentInfo.pagesRanges, attachmentInfo.reason, attachmentInfo.sentDateMmtUtc.format(), attachmentInfo.from);
    }
};

export const handleMessage = async (processedAttachments: { [key: string]: TAttachmentInfo }, msgId: string): Promise<TAttachmentInfo | null> => {
    const gmailApi = await getGmailApi();
    const messageResponse = await gmailApi.users.messages.get({
        id: msgId,
        userId: 'me',
    });
    const message = messageResponse.data;
    const subject = getSubject(message);
    const from = getFrom(message);
    const to = getTo(message);
    const sentDateMmtUtc = getSentDateMmtUtc(message);
    const pdfPart = findPdfPart(message);
    const fileName = pdfPart && pdfPart.filename;
    const attachmentId = pdfPart && pdfPart.body && pdfPart.body.attachmentId;
    if (!subject || !fileName || !attachmentId || !sentDateMmtUtc || !from || !to) {
        return null;
    }
    const processedAttachment = processedAttachments[attachmentId];
    if (processedAttachment) {
        log("ALREADY PROCESSED", processedAttachment);
        return processedAttachment;
    }
    const pagesRanges = getPagesRanges(subject, fileName, from, to);
    const inProgessAttachment: TAttachmentInfo = {
        timeStamp: moment(),
        reason: pagesRanges.reason,
        pagesRanges: pagesRanges.pagesRanges,
        sentDateMmtUtc: sentDateMmtUtc,
        from: from,
        subject: subject,
        fileName: fileName,
        messageId: msgId,
        attachmentId: attachmentId
    };
    if (!pagesRanges.pagesRanges) {
        log("NOT PRINTING", inProgessAttachment);
        return inProgessAttachment;
    }
    const attResponse = await gmailApi.users.messages.attachments.get({
        id: attachmentId,
        messageId: msgId,
        userId: 'me'
    });
    const dataBase64 = attResponse.data.data;
    if (!dataBase64) {
        const errorAttachmentInfo = {
            ...inProgessAttachment,
            pagesRanges: null,
            reason: `ERROR(no data in attachment part)`
        };
        log("ERROR", errorAttachmentInfo);
        return errorAttachmentInfo;
    }
    if (cfg.print) {
        try {
            await printFile(Buffer.from(dataBase64, 'base64'), pagesRanges.pagesRanges);
        } catch(e) {
            log("ERROR-PRINTED: " + e, inProgessAttachment);
            return null;
        }
        log("PRINTED", inProgessAttachment);
    } else {
        log("DRY-PRINTED", inProgessAttachment);
    }
    return inProgessAttachment;
};

const writeProcessedAttachements = (processedAttachments: TAttachmentInfo[]) => new Promise((resolve, reject) => {
    fs.writeFile(path.join(dataDir, attachmentsFileName), JSON.stringify(processedAttachments), (err) => {
        if (err) return reject(err);
        resolve();
    });
});

const printFile = (dataBase64: Buffer, pageRanges: string) => new Promise((resolve, reject) => {
    const printer = new Printer("http://192.168.2.2:631/printers/Brother_DCP-7030");
    const msg = {
        "operation-attributes-tag": {
            "document-format": "application/pdf",
        },
        'page-ranges': pageRanges,
        data: dataBase64
    };
    printer.execute("Print-Job", msg, (err: any, res: any) => {
        if (err) return reject(err);
        resolve(res);
    });
});

export const listMessages = async () => {
    const gmailApi = await getGmailApi();
    const messagesResponse = await gmailApi.users.messages.list({
        userId: 'me',
    });

    //todo read processedAttachment here
    const processedAttachments: { [attachementId: string]: TAttachmentInfo } = {};

    const array: Array<Promise<TAttachmentInfo | null>> = _.map(messagesResponse.data.messages, message => {
        if (!message.id) {
            return Promise.resolve(null);
        }
        return handleMessage(processedAttachments, message.id)
    });

    const processed: Array<TAttachmentInfo | null> = await Promise.all(array);
    const newProcessedAttachment: TAttachmentInfo[] = _.compact(processed);

    //todo write newProcessedAttachment here

};
