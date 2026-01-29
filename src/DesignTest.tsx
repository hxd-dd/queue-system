import { useState } from 'react'
import './DesignTest.css'

/**
 * Frontend Design Skill 测试组件
 * 
 * 审美方向：Retro-Futuristic（复古未来主义）
 * - 深色背景 + 霓虹色点缀
 * - 几何线条 + 玻璃质感
 * - 错位布局 + 斜切元素
 * 
 * 记忆点：
 * - 不对称的斜切标题区
 * - 霓虹色光晕动效
 * - 粒子噪点背景纹理
 */
export default function DesignTest() {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="design-test-root">
      {/* 背景层：渐变 + 噪点 */}
      <div className="bg-mesh" />
      <div className="bg-noise" />
      
      <div className="container">
        {/* 主标题区：斜切 + 错位 */}
        <header className="header-section">
          <div className="title-wrapper">
            <h1 className="title-main">
              <span className="title-accent">FRONTEND</span>
              <span className="title-sub">DESIGN</span>
            </h1>
            <div className="title-line" />
          </div>
          <p className="subtitle">
            技能测试组件 · 复古未来主义风格
          </p>
        </header>

        {/* 卡片组：玻璃质感 + 悬停动效 */}
        <div className="cards-grid">
          <Card
            index={0}
            title="Typography"
            desc="独特的字体选择，避免默认系统字体"
            accentColor="#00f5ff"
            onHover={setHovered}
          />
          <Card
            index={1}
            title="Color & Theme"
            desc="统一的配色系统，使用 CSS 变量管理"
            accentColor="#ff00ff"
            onHover={setHovered}
          />
          <Card
            index={2}
            title="Motion"
            desc="精心设计的动效，错峰出现的进场动画"
            accentColor="#ffff00"
            onHover={setHovered}
          />
        </div>

        {/* CTA 按钮：霓虹效果 */}
        <div className="cta-section">
          <button
            className={`cta-button ${hovered ? 'hovered' : ''}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <span className="cta-text">测试完成</span>
            <span className="cta-glow" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface CardProps {
  index: number
  title: string
  desc: string
  accentColor: string
  onHover: (hovered: boolean) => void
}

function Card({ index, title, desc, accentColor, onHover }: CardProps) {
  return (
    <div
      className="card"
      style={{
        '--card-index': index,
        '--accent-color': accentColor,
      } as React.CSSProperties}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="card-border" />
      <div className="card-content">
        <h3 className="card-title">{title}</h3>
        <p className="card-desc">{desc}</p>
      </div>
      <div className="card-accent-line" />
    </div>
  )
}
