import { useState, useEffect } from 'react'
import { Card } from '../components/Card'
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Server,
  FileText,
  RefreshCw
} from 'lucide-react'
import {
  type ApprovalRequest,
  getPendingApprovals,
  getMyApprovalRequests,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getExpiryTimeRemaining,
  getApprovalStatusColor
} from '../utils/approvalWorkflow'
import { type PLCPullPermissions } from '../utils/plcPermissions'

interface ApprovalDashboardProps {
  permissions: PLCPullPermissions
  currentUser: {
    userId: string
    username: string
    role: string
  }
}

export function ApprovalDashboard({ permissions, currentUser }: ApprovalDashboardProps) {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [myRequests, setMyRequests] = useState<ApprovalRequest[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'my-requests'>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadApprovals()
  }, [])

  const loadApprovals = async () => {
    setIsLoading(true)
    try {
      if (permissions.canViewPendingApprovals) {
        const pending = await getPendingApprovals()
        setPendingApprovals(pending)
      }
      
      const myReqs = await getMyApprovalRequests(currentUser.userId)
      setMyRequests(myReqs)
    } catch (error) {
      console.error('Failed to load approvals:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (request: ApprovalRequest) => {
    if (!permissions.canApproveProductionPull) {
      alert('You do not have permission to approve production pulls')
      return
    }

    const notes = prompt('Add approval notes (optional):')
    
    setProcessingId(request.id)
    try {
      const success = await approveRequest(
        request.id,
        {
          userId: currentUser.userId,
          username: currentUser.username,
          role: currentUser.role
        },
        notes || undefined
      )
      
      if (success) {
        alert('Approval granted successfully')
        await loadApprovals()
      } else {
        alert('Failed to approve request')
      }
    } catch (error) {
      alert('Error approving request')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (request: ApprovalRequest) => {
    if (!permissions.canApproveProductionPull) {
      alert('You do not have permission to reject production pulls')
      return
    }

    const reason = prompt('Reason for rejection (required):')
    if (!reason) return
    
    const notes = prompt('Add additional notes (optional):')
    
    setProcessingId(request.id)
    try {
      const success = await rejectRequest(
        request.id,
        {
          userId: currentUser.userId,
          username: currentUser.username,
          role: currentUser.role
        },
        reason,
        notes || undefined
      )
      
      if (success) {
        alert('Request rejected')
        await loadApprovals()
      } else {
        alert('Failed to reject request')
      }
    } catch (error) {
      alert('Error rejecting request')
    } finally {
      setProcessingId(null)
    }
  }

  const handleCancel = async (requestId: string) => {
    if (!confirm('Cancel this approval request?')) return
    
    setProcessingId(requestId)
    try {
      const success = await cancelRequest(requestId, currentUser.userId)
      
      if (success) {
        alert('Request cancelled')
        await loadApprovals()
      } else {
        alert('Failed to cancel request')
      }
    } catch (error) {
      alert('Error cancelling request')
    } finally {
      setProcessingId(null)
    }
  }

  const renderApprovalCard = (request: ApprovalRequest, showActions: boolean) => (
    <Card key={request.id} className="p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Server className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {request.runtime.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {request.runtime.environment} • {request.runtime.ipAddress}
              </p>
            </div>
          </div>
          
          <span className={`px-2 py-1 text-xs font-medium rounded ${getApprovalStatusColor(request.status)}`}>
            {request.status.toUpperCase()}
          </span>
        </div>

        {/* Request Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              {request.requestedBy.username}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              {request.status === 'pending' ? `Expires in ${getExpiryTimeRemaining(request)}` : new Date(request.requestedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Reason */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reason</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">{request.reason}</p>
            </div>
          </div>
        </div>

        {/* Snapshot Scope */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(request.snapshotScope).map(([key, enabled]) => 
            enabled && (
              <span key={key} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            )
          )}
        </div>

        {/* Approval/Rejection Info */}
        {request.approvedBy && (
          <div className="p-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded text-sm">
            <p className="text-green-900 dark:text-green-100">
              ✓ Approved by {request.approvedBy.username} on {new Date(request.approvedAt!).toLocaleString()}
            </p>
          </div>
        )}
        
        {request.rejectedBy && (
          <div className="p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded text-sm">
            <p className="text-red-900 dark:text-red-100">
              ✗ Rejected by {request.rejectedBy.username}: {request.rejectionReason}
            </p>
          </div>
        )}

        {/* Actions */}
        {showActions && request.status === 'pending' && (
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            {permissions.canApproveProductionPull && (
              <>
                <button
                  onClick={() => handleApprove(request)}
                  disabled={processingId === request.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(request)}
                  disabled={processingId === request.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </>
            )}
            
            {request.requestedBy.userId === currentUser.userId && (
              <button
                onClick={() => handleCancel(request.id)}
                disabled={processingId === request.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors disabled:opacity-50 ml-auto"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  )

  if (!permissions.canViewPendingApprovals && myRequests.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No Access</p>
          <p className="text-sm mt-2">You don't have permission to view approvals.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Approval Requests</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Review and manage PLC pull approval requests
          </p>
        </div>
        
        <button
          onClick={loadApprovals}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {permissions.canViewPendingApprovals && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-[#FF6A00] text-[#FF6A00]'
                : 'border-transparent text-gray-600 dark:text-gray-400'
            }`}
          >
            Pending ({pendingApprovals.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('my-requests')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'my-requests'
              ? 'border-[#FF6A00] text-[#FF6A00]'
              : 'border-transparent text-gray-600 dark:text-gray-400'
          }`}
        >
          My Requests ({myRequests.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {isLoading ? (
          <Card className="p-8">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p>Loading approvals...</p>
            </div>
          </Card>
        ) : (
          <>
            {activeTab === 'pending' && (
              <>
                {pendingApprovals.length === 0 ? (
                  <Card className="p-8">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No Pending Approvals</p>
                      <p className="text-sm mt-2">All requests have been processed.</p>
                    </div>
                  </Card>
                ) : (
                  pendingApprovals.map(request => renderApprovalCard(request, true))
                )}
              </>
            )}
            
            {activeTab === 'my-requests' && (
              <>
                {myRequests.length === 0 ? (
                  <Card className="p-8">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No Requests</p>
                      <p className="text-sm mt-2">You haven't submitted any approval requests yet.</p>
                    </div>
                  </Card>
                ) : (
                  myRequests.map(request => renderApprovalCard(request, request.status === 'pending'))
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
