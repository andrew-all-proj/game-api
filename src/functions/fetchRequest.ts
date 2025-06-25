import axios, { AxiosRequestConfig, Method } from 'axios'

interface FetchRequest {
  url: string
  method?: Method
  data?: any
  headers?: Record<string, string>
}

export async function fetchRequest<T = any>({
  url,
  method = 'GET',
  data,
  headers = {},
}: FetchRequest): Promise<{ data?: T; error?: any }> {
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
    return { data: response.data }
  } catch (error: any) {
    const errorData = error.response?.data || error.message
    console.error(`❌ Request failed [${method}] ${url}:`, errorData)
    return { error: errorData }
  }
}
