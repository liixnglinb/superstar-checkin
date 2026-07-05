import * as tencentcloud from 'tencentcloud-sdk-nodejs'
import config from '../providers/config'

const OcrClient = tencentcloud.ocr.v20181119.Client

let client: any = null

function getClient() {
    if (!client) {
        client = new OcrClient({
            credential: {
                secretId: config.ocr.secretId,
                secretKey: config.ocr.secretKey,
            },
            region: 'ap-shanghai',
            profile: {
                httpProfile: {
                    endpoint: 'ocr.tencentcloudapi.com',
                },
            },
        })
    }
    return client
}

export default async (url: string): Promise<string> => {
    const data: any = await getClient().QrcodeOCR({
        ImageUrl: url,
    })
    return data.CodeResults[0].Url
}
