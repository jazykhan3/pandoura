import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white dark:bg-panda-card-dark border border-gray-200 dark:border-panda-border-dark rounded-lg shadow-soft dark:shadow-soft-dark transition-colors duration-300 ${className}`}>
      {children}
    </div>
  )
}

type CardHeaderProps = {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <h2 className={`text-lg font-medium mb-3 text-gray-800 dark:text-white ${className}`}>
      {children}
    </h2>
  )
}

