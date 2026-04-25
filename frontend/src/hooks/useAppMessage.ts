import { App } from 'antd'

export function useAppMessage() {
  const { message } = App.useApp()
  return message
}
