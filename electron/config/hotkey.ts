const mod = process.platform === "darwin" ? "m" : "c"
export default {
  "chat-input:submit": `<${mod}-enter>`,
  "chat-input:upload-file": `<${mod}-u>`,
  "chat-input:focus": `<${mod}-k>`,
  "chat-input:past-last-message": `<${mod}-V>`,
  "chat-message:copy-last": `<${mod}-C>`,
  "chat-message:delete": `<${mod}-backspace>`,
  "global:new-chat": `<${mod}-O>`,
  "global:toggle-sidebar": `<${mod}-S>`,
  "global:close-layer": `<escape>`,
}
