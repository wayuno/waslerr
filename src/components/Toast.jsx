import { useStore } from '../store/StoreProvider'
import { CheckIcon } from './icons'

// Site-wide toast — driven by store.toast (set via showToast).
export default function Toast() {
  const { toast } = useStore()
  if (!toast) return null
  return (
    <div className="wf-toast" role="status" key={toast.key}>
      <span className="wf-toast-ic">
        <CheckIcon size={15} stroke={2.4} />
      </span>
      {toast.message}
    </div>
  )
}
