import {PC_AGENT} from '../constants'
import axios from 'axios'
import {error} from '../utils/log'

export default async function validateCookie(cookie: string):Promise<boolean> {
    try {
        const response = await axios.get("https://i.mooc.chaoxing.com/space/", {
            headers: {
                Cookie: cookie,
                "User-Agent": PC_AGENT,
            },
            params: {
                rss: 1,
                catalogId: 0,
                start: 0,
                size: 500,
            },
            timeout: 10000,
            proxy: false
        });

        return !response.data.includes("用户登录");
    } catch (e) {
        error('validateCookie 网络请求失败', e);
        return false;
    }
}
