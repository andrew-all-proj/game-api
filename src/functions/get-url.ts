import config from '../config'

export const getFileUrl = (fileUrl?: string) => {
  if (!fileUrl) return null
  const baseUrl = config.fileUrlPrefix
  return `${baseUrl}${fileUrl}`
}
