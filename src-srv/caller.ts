import {userInfo} from 'os';

export const call = () => {
    console.log(`OK: ${userInfo().username}:${userInfo().gid}`);
    setTimeout(call, 1000);
};

call();
