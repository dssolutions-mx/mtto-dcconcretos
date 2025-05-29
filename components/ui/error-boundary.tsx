"use client"

import React from "react"
import { AlertTriangle, RefreshCcw, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    
    // Log error for debugging
    console.error('Error Boundary caught an error:', error)
    console.error('Error Info:', errorInfo)
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} retry={this.retry} />
      }

      return <DefaultErrorFallback error={this.state.error!} retry={this.retry} />
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error: Error
  retry: () => void
}

function DefaultErrorFallback({ error, retry }: ErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl">¡Ups! Algo salió mal</CardTitle>
          <CardDescription>
            Ha ocurrido un error inesperado. Puedes intentar recargar la página o volver atrás.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDevelopment && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Error de desarrollo:</strong> {error.message}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={retry} className="flex-1">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Intentar de nuevo
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver atrás
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/dashboard'}
            className="w-full"
          >
            Ir al Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// Hook for programmatic error handling
export function useErrorHandler() {
  return (error: Error, context?: string) => {
    console.error(`Error in ${context || 'component'}:`, error)
    
    // You could also send to error reporting service here
    // sendToErrorReporting(error, context)
  }
}

export default ErrorBoundary 