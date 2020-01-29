const fs = require('fs');
const moment = require('moment');
const ipp = require('ipp');
const PDFDocument = require('pdfkit');

describe("Write test", () => {
    it("should write file", () => new Promise((resolve, reject) => {
        fs.writeFile("./src-srv/__test__/test.txt", "QUJD", {encoding: "base64"}, (err) => {
            if (err) return reject(err);
            resolve();
        });
    }));

    it("create directory", () => new Promise((resolve, reject) => {
        fs.mkdir("./src-srv/__test__/__tt", {recursive: true}, err => {
            if (err) return reject(err);
            resolve();
        })
    }));

    it("should convert date", () => {
        const parsedMmt = moment.utc('Fri, 29 Nov 2019 07:19:00 +0000 (GMT)');
        console.log(parsedMmt.format("YYYY_MM_DD-hh_mm_ss"));
    });

    it('should print', () => new Promise((resolve, reject) => {

        const buffers = [];
        const doc = new PDFDocument();
        doc.text("Hello World");
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', function () {
            var printer = ipp.Printer("http://192.168.2.2:631/printers/Brother_DCP-7030", {version: "2.0"});
            var msg = {
                "operation-attributes-tag": {
                    "requesting-user-name": "William",
                    "job-name": "My Test Job",
                    "document-format": "application/pdf"
                },
                data: Buffer.concat(buffers)
            };
            printer.execute("Print-Job", msg, function (err, res) {
                if (err) return reject(err);
                console.log(res);
                resolve();
            });
        });
        doc.end();
    }));

    it('get printer attribute', () => new Promise((resolve, reject) => {
        var printer = ipp.Printer('http://192.168.2.2:631/printers/Brother_DCP-7030');

        printer.execute('Get-Printer-Attributes', null, (err, res) => {
            if (err) return reject(err);
            console.log(res);
            resolve(res);
        });
    }))

});
