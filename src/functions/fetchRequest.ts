import axios, { AxiosRequestConfig, Method } from 'axios'

interface FetchRequest {
  url: string
  method?: Method
  data?: any
  headers?: Record<string, string>
}

export async function fetchRequest<T = any>({ url, method = 'GET', data, headers = {} }: FetchRequest): Promise<T> {
  const config: AxiosRequestConfig = {
    url,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(data ? { data } : {}),
  }

  try {
    const response = await axios(config)
    return response.data
  } catch (error: any) {
    const message = error.response?.data || error.message
    console.error(`❌ Request failed [${method}] ${url}:`, message)
    throw message
  }
}
