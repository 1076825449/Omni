// 全局搜索结果页
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, List, Typography, Input, Tag, Spin, Empty, Button, Space } from 'antd'
import { searchApi, SearchResult } from '../../services/api'

const { Title, Text } = Typography

const typeMap: Record<string, { label: string; color: string }> = {
  task: { label: '任务', color: 'blue' },
  file: { label: '文件', color: 'green' },
  log: { label: '日志', color: 'purple' },
  module: { label: '模块', color: 'orange' },
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!query) return
    setLoading(true)
    searchApi.search(query).then(({ results: data }) => {
      setResults(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [query])

  const handleSearch = (value: string) => {
    setSearchParams({ q: value })
  }

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>搜索</Title>
        <Input.Search
          defaultValue={query}
          placeholder="输入关键词回车搜索"
          onSearch={handleSearch}
          style={{ width: 400, marginTop: 8 }}
          size="large"
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : !query ? (
        <Empty description="请输入关键词搜索" />
      ) : results.length === 0 ? (
        <Empty description={`未找到与"${query}"相关的结果`} />
      ) : (
        <Card title={`找到 ${results.length} 条结果`} style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={results}
            renderItem={(item: SearchResult) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(item.url)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{item.title}</Text>
                      <Tag color={typeMap[item.type]?.color}>{typeMap[item.type]?.label}</Tag>
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.subtitle}</Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  )
}
