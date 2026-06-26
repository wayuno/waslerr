import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'
import { CartIcon } from './icons'

// Nav cart button with a count badge that pops when an item is added. Clicking
// it checks out the most recently added item (single-product demo checkout).
export default function CartButton() {
  const { cart, cartCount, goCheckout, navigate } = useStore()
  const [pop, setPop] = useState(false)
  const prev = useRef(cartCount)

  useEffect(() => {
    if (cartCount > prev.current) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 600)
      prev.current = cartCount
      return () => clearTimeout(t)
    }
    prev.current = cartCount
  }, [cartCount])

  const onClick = () => {
    if (cart.length) goCheckout(cart[cart.length - 1].id)
    else navigate('fields')
  }

  return (
    <button className="wf-cart-btn" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`} onClick={onClick}>
      <CartIcon />
      {cartCount > 0 && <span className={`wf-cart-badge${pop ? ' pop' : ''}`}>{cartCount}</span>}
    </button>
  )
}
