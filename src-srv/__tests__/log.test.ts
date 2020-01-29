import {appendSuccessEntry} from '../log';
import {pathToLog} from '../constants';

jest.mock('../constants', () => {
    return {
       pathToLog: './src-srv/__tests__/out-tmp/fake-log.txt',
        ok: 'OK'
    }
});

describe("log", () => {
    it('should add line', async () => {
        await appendSuccessEntry('test');
    });
});
