import { useEffect } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useMenuStore, retryMenu } from '../stores/menuStore.js'
import { useOrderStore } from '../stores/orderStore.js'
import { useTable } from '../hooks/useTable.js'
import { getSocket } from '../hooks/useSocket.js'
import MenuPanel from './order/MenuPanel.js'
import CartPanel from './order/CartPanel.js'

export default function OrderView() {
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const { snapshot, loading: menuLoading, error: menuError, fetch: fetchMenu, setSnapshot } = useMenuStore()
  const { setTableId } = useOrderStore()
  const { table, loading: tableLoading, error: tableError, isTokenMode } = useTable()

  useEffect(() => { void fetchMenu() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the menu live when management updates it mid-service.
  useEffect(() => {
    const socket = getSocket()
    socket.emit('view:join', { room: 'management' })
    socket.on('menu:updated', setSnapshot)
    return () => { socket.off('menu:updated', setSnapshot) }
  }, [setSnapshot])

  // QR mode: lock the store's tableId to the resolved table
  useEffect(() => {
    if (table) setTableId(table.id)
  }, [table?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (menuLoading || tableLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (tableError) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 2, p: 4 }}>
        <Typography variant="h6" color="error">{tableError}</Typography>
        <Typography color="text.secondary" textAlign="center">
          The QR code link may have expired. Ask a staff member to rescan your table.
        </Typography>
      </Box>
    )
  }

  if (menuError) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 2, p: 4 }}>
        <Typography variant="h6" color="error">Menu unavailable</Typography>
        <Typography color="text.secondary">{menuError}</Typography>
        <Button variant="contained" onClick={() => void retryMenu()} sx={{ minHeight: 48 }}>
          Try again
        </Button>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isLandscape ? 'row' : 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {snapshot && <MenuPanel />}
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          width: isLandscape ? 360 : '100%',
          height: isLandscape ? '100%' : '45%',
          overflow: 'hidden',
          borderLeft: isLandscape ? 1 : 0,
          borderTop: isLandscape ? 0 : 1,
          borderColor: 'divider',
        }}
      >
        <CartPanel tableFromToken={table} isTokenMode={isTokenMode} />
      </Box>
    </Box>
  )
}
