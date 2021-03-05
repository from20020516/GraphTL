import { ApiClient, Client, HttpMethod, ObjectLike, QueryParameters } from './client-generated'
import axios, { Method, AxiosError } from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

export const client = axios.create({
    headers: {
        Authorization: `Bearer ${process.env.BEARER_TOKEN}`
    },
    baseURL: 'https://api.twitter.com'
})
client.interceptors.request.use(request => {
    request.params = Object.fromEntries(Object.entries(request.params).map(array => {
        if (typeof array[1] !== 'object') return array
        if (Array.isArray(array[1])) return [array[0], array[1].join()]
        if (Array.isArray(array[1]['value'])) return [array[0], array[1]['value'].join()]
        if (array[1]['value']) return [array[0], array[1]['value']]
        return []
    }))
    return request
}, (error: AxiosError) => {
    console.error('ERR_REQUEST:', error.request)
    process.exit(1)
})
client.interceptors.response.use((response) => {
    return response
}, (error: AxiosError) => {
    console.error('ERR_RESPONSE:', error.response?.status, error.response?.statusText)
    process.exit(1)
})
interface RequestOption {
    retries?: number
    timeout?: number
    deadline?: number
}
const convertHttpMethodToAxiosMethod = (httpMethod: HttpMethod): Method => {
    const patterns: { [key in HttpMethod]: Method } = {
        GET: 'GET',
        PUT: 'PUT',
        POST: 'POST',
        DELETE: 'DELETE',
        OPTIONS: 'OPTIONS',
        HEAD: 'HEAD',
        PATCH: 'PATCH',
        TRACE: 'POST', // ?
    }
    return patterns[httpMethod]
}
const apiClientImpl: ApiClient<RequestOption> = {
    request: async (
        httpMethod: HttpMethod,
        url: string,
        headers: ObjectLike | any,
        requestBody: ObjectLike | any,
        queryParameters: QueryParameters | undefined,
        options?: RequestOption,
    ): Promise<any> => {

        return (await client({
            baseURL: url,
            method: convertHttpMethodToAxiosMethod(httpMethod),
            headers,
            params: queryParameters,
            data: requestBody,
            timeout: options?.timeout,
        })).data
    }
}

/**
 * Twitter v2 API Client
 * @requires process.env.BEARER_TOKEN
 * @see https://developer.twitter.com/en/docs/twitter-api
 */
export const V2Client = new Client<RequestOption>(apiClientImpl, 'https://api.twitter.com')

