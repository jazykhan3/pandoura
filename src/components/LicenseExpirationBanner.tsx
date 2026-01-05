import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

/**
 * License Expiration Banner
 * 
 * Displays persistent warning when license is expired or in grace period
 * 
 * Usage: Add to Layout.tsx or App.tsx at the top of the page
 * 
 * <LicenseExpirationBanner />
 */

interface ExpirationStatus {
  expired: boolean
  daysRemaining: number | null
  expiresAt: string | null
  isGracePeriod: boolean
  licenseType?: string
}

export function LicenseExpirationBanner() {
  const [expirationStatus, setExpirationStatus] = useState<ExpirationStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    checkLicenseExpiration()
    
    // Check every hour
    const interval = setInterval(checkLicenseExpiration, 60 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  const checkLicenseExpiration = async () => {
    try {
      const response = await fetch('/api/device/license/expiration-status', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpirationStatus(data.expirationStatus)
        // readOnlyMode is in data but not used in component
      }
    } catch (error) {
      console.error('Failed to check license expiration:', error)
    }
  }

  // Don't show banner if dismissed or no expiration status
  if (dismissed || !expirationStatus) {
    return null
  }

  // Don't show if license is valid and not in grace period
  if (!expirationStatus.expired && !expirationStatus.isGracePeriod) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className={`relative ${
          expirationStatus.expired
            ? 'bg-red-600'
            : 'bg-yellow-500'
        } text-white px-6 py-3 shadow-lg z-50`}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center flex-1">
            <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              {expirationStatus.expired ? (
                <p className="font-medium">
                  <strong>License Expired</strong> - Read-only mode active. 
                  {expirationStatus.daysRemaining !== null && (
                    <> Expired {Math.abs(expirationStatus.daysRemaining)} days ago.</>
                  )}
                  {' '}Please renew your license to restore full functionality.
                </p>
              ) : expirationStatus.isGracePeriod ? (
                <p className="font-medium">
                  <strong>License Expiring Soon</strong> - Your license expires in{' '}
                  <strong>{expirationStatus.daysRemaining} days</strong>. 
                  Please renew to avoid service interruption.
                </p>
              ) : null}
            </div>
            
            {/* Renew Button */}
            <button
              onClick={() => {
                window.location.hash = '#/settings?tab=licenses'
              }}
              className="ml-4 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg font-medium transition-colors"
            >
              {expirationStatus.expired ? 'Renew License' : 'Manage License'}
            </button>
          </div>

          {/* Dismiss (only for grace period, not for expired) */}
          {!expirationStatus.expired && (
            <button
              onClick={() => setDismissed(true)}
              className="ml-4 p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
