import { attachHandlers } from "./handlers"
import { KeyValueData, TXDAConnection, TXDAMessageHandlers } from "./types"

/**
 * Request a connection to the Torx Design-Analyze application that the current page is embedded in.
 * @param url The URL of the Torx Design-Analyze installation that the current page is embedded in. Used to ensure that only messages from the correct origin URL are accepted.
 * @param handlers Event handlers to execute when events are received from Torx Design-Analyze.
 */
const initialize = (url: string, handlers: TXDAMessageHandlers = {}): Promise<TXDAConnection> =>
  new Promise((resolve, reject) => {
    const origin = new URL(url).origin

    if (origin === '*') {
      reject('Specific target origins must be specified to connect to TXDA installs')
      return
    }

    const handleWindowEvent = (windowEvent: MessageEvent) => {
      if (windowEvent.data?.messageType === 'txdaMessagePortTransfer') {
        // Ensure the origin of the message matches the specified URL's origin
        if (windowEvent.origin !== origin) {
          reject('Attempted TXDA connection event from unauthorized origin')
          return
        }

        // Ensure that the source of the event is the window embedding this one
        if (windowEvent.source !== window.parent) {
          reject('Attempted TXDA connection event from unauthorized source')
          return
        }

        const port = windowEvent.ports[0]

        // Add any given event handlers to the port
        attachHandlers(port, handlers)

        port.start()

        // Fire an initial request for the current design as soon as the port starts
        port.postMessage({ messageType: 'txdaRequestCurrentDesign' })

        const txdaConnection: TXDAConnection = {
          _port: port,
          requestCurrentDesign: () => port.postMessage({
            messageType: 'txdaRequestCurrentDesign'
          }),
          requestCurrentDesign3d: () => port.postMessage({
            messageType: 'txdaRequestCurrentDesign3d'
          }),
          requestCurrentDesignData: () => port.postMessage({
            messageType: 'txdaRequestCurrentDesignData'
          }),
          addCurrentDesignData: (data: KeyValueData) => port.postMessage({
            messageType: 'txdaAddCurrentDesignData',
            data
          }),
          addCurrentStructureData: (data: KeyValueData) => port.postMessage({
            messageType: 'txdaAddCurrentStructureData',
            data
          }),
          disconnect: () => {
            port.close()
            handlers.onDisconnected?.()
          }
        }

        resolve(txdaConnection)
      }
    }

    // Listen for events from TXDA for initial setup of MessagePort,
    // removing the event listener after a single invocation
    window.addEventListener('message', handleWindowEvent, { once: true })

    window.parent.postMessage({
      messageType: 'txdaConnectionRequest',
      windowName: window.name,
    }, origin)

    // If there's no response from TXDA, reject
    setTimeout(() => {
      reject('Connection to TXDA failed (timed out)')
    }, 10000)
  })

export { initialize }
