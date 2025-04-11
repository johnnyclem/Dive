import { ModelConfig } from "./atoms/configState"


export const getModelPrefix = (config: ModelConfig, length: number = 5) => {
  if (config.apiKey)
    return config.apiKey.slice(-length)

  if ((config as any).accessKeyId)
    return (config as any).accessKeyId.slice(-length)


  try {
    if(config.baseURL) {
      const url = new URL(config.baseURL)
      return url.hostname.slice(0, length)
    }
  } catch (error) {
    return config.baseURL
  }
  return ""
}

export function safeBase64Encode(str: string): string {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16))))
  } catch (e) {
    console.error("Encoding error:", e)
    return ""
  }
}

export function safeBase64Decode(str: string): string {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str),
      c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""))
  } catch (e) {
    console.error("Decoding error:", e)
    return str
  }
}

export function date2unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

export function unix2date(unix: number) {
  return new Date(unix * 1000);
}

export function fileSize(sizeInBytes: number) {
  const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024));
  return (
    (sizeInBytes / 1024 ** i).toFixed(1) + ['B', 'KB', 'MB', 'GB', 'TB'][i]
  );
}

export function paddingZero(num: number, length: number) {
  return (Array(length).join('0') + num).slice(-length);
}

export function fmtDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export function fmtDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${fmtDate(date)} ${hours}:${minutes}:${seconds}`;
}
