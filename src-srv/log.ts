import moment from 'moment';
import fs from 'fs';
import os from 'os';
import {OK, pathToLog} from './constants'

export const getLastModificationTime = () => {
    return moment();
};

export const appendSuccessEntry = (message: string) => new Promise((resolve, reject) => {
    const currentDate = moment();
    const messageEntry = [currentDate.format(), OK, message].join(';') + os.EOL;
    fs.appendFile(pathToLog, messageEntry, (err) => {
        if (err) return reject(err);
        resolve();
    });
});
