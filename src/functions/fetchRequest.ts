/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios, { AxiosRequestConfig, Method, AxiosError } from 'axios'
import { logger } from './logger'

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
}: FetchRequest): Promise<{ data?: T; error?: unknown }> {
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
    const response = await axios<T>(config)
    return { data: response.data }
  } catch (err) {
    const error = err as AxiosError

    const status = error.response?.status
    const errorData = error.response?.data ?? error.message

    logger.error(`❌ Request failed [${method}] ${url}`, {
      error: errorData,
      status,
    })

    return { error: errorData }
  }
}
