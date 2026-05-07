import { Space, Typography } from 'antd'
import type { ReactNode } from 'react'

const { Title, Text } = Typography

interface BusinessPageHeaderProps {
  title: string
  description?: ReactNode
  meta?: ReactNode
  extra?: ReactNode
}

export default function BusinessPageHeader({ title, description, meta, extra }: BusinessPageHeaderProps) {
  return (
    <div className="business-page-header">
      <Space className="business-page-header-inner" align="start" wrap>
        <Space direction="vertical" size={6} className="business-page-heading">
          <Title level={4} className="business-page-title">{title}</Title>
          {description && <Text type="secondary" className="business-page-description">{description}</Text>}
          {meta && <div className="business-page-meta">{meta}</div>}
        </Space>
        {extra && <div className="business-page-extra">{extra}</div>}
      </Space>
    </div>
  )
}
