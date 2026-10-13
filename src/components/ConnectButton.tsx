import { usePuffco } from '../ble/PuffcoContext'

export function ConnectButton() {
  const { status, connectDevice, disconnectDevice, busy, bleSupported } = usePuffco()

  if (status === 'connected') {
    return (
      <button type="button" className="btn btn-ghost btn-full" onClick={disconnectDevice} disabled={busy}>
        Disconnect
      </button>
    )
  }

  return (
    <div className="connect-block">
      <button
        type="button"
        className="btn btn-connect btn-full squish"
        onClick={connectDevice}
        disabled={busy || !bleSupported}
      >
        {busy || status === 'connecting' ? 'Finding your Peak...' : 'Connect to Peak'}
      </button>
      <p className="hint">Close the Puffco app first · hold the button until the light bar turns blue</p>
    </div>
  )
}
