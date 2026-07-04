import axios from 'axios'
import * as queryString from 'querystring'
import {PC_AGENT} from '../constants'
import {wrapper} from 'axios-cookiejar-support'
import {CookieJar} from 'tough-cookie'
import LoginReturn from '../types/LoginReturn'

const jar = new CookieJar()
const client = wrapper(axios.create({jar, proxy: false}))

export default async function login(account: string, password: string) {
    const response: LoginReturn = (await client.post(
        'https://passport2-api.chaoxing.com/v11/loginregister',
        queryString.stringify({
            uname: account,
            code: password,
        }),
        {
            headers: {
                'User-Agent': PC_AGENT,
            },
        },
    )).data

    if (response.status) {
        const cookies = jar.toJSON().cookies
        const uid = parseInt(cookies.find((cookie) => cookie.key === "UID")!.value)
        const fidCookie = cookies.find((cookie) => cookie.key === "fid")
        const fid = fidCookie ? parseInt(fidCookie.value) : 0

        // 用 mobilelearn 子域取 cookie，确保签到请求能匹配
        const cookieForSign = jar.getCookieStringSync("https://mobilelearn.chaoxing.com")

        return {
            cookie: cookieForSign,
            uid,
            fid,
        }
    }
    else {
        throw new Error(response.mes)
    }
}
