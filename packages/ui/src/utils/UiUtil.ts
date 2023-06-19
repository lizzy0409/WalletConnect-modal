import type { WalletData } from '#core'
import {
  ClientCtrl,
  ConfigCtrl,
  CoreUtil,
  ExplorerCtrl,
  ModalCtrl,
  OptionsCtrl,
  RouterCtrl,
  ToastCtrl,
  WcConnectionCtrl
} from '#core'
import type { LitElement } from 'lit'

export const UiUtil = {
  MOBILE_BREAKPOINT: 600,

  WCM_RECENT_WALLET_DATA: 'WCM_RECENT_WALLET_DATA',

  EXPLORER_WALLET_URL: 'https://explorer.walletconnect.com/?type=wallet',

  getShadowRootElement(root: LitElement, selector: string) {
    const el = root.renderRoot.querySelector(selector)
    if (!el) {
      throw new Error(`${selector} not found`)
    }

    return el as HTMLElement
  },

  getWalletIcon({ id, image_id }: { id: string; image_id?: string }) {
    const { walletImages } = ConfigCtrl.state

    if (walletImages?.[id]) {
      return walletImages[id]
    } else if (image_id) {
      return ExplorerCtrl.getWalletImageUrl(image_id)
    }

    return ''
  },

  getWalletName(name: string, short = false) {
    return short ? name.split(' ')[0] : name
  },

  isMobileAnimation() {
    return window.innerWidth <= UiUtil.MOBILE_BREAKPOINT
  },

  async preloadImage(src: string) {
    const imagePromise = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = resolve
      image.onerror = reject
      image.src = src
    })

    return Promise.race([imagePromise, CoreUtil.wait(3_000)])
  },

  getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Unknown Error'
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debounce(func: (...args: any[]) => unknown, timeout = 500) {
    let timer: NodeJS.Timeout | undefined = undefined

    return (...args: unknown[]) => {
      function next() {
        func(...args)
      }
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(next, timeout)
    }
  },

  handleMobileLinking(wallet: WalletData) {
    const { standaloneUri } = OptionsCtrl.state
    const { pairingUri } = WcConnectionCtrl.state
    const { mobile, name } = wallet
    const nativeUrl = mobile?.native
    const universalUrl = mobile?.universal

    UiUtil.setRecentWallet(wallet)

    function onRedirect(uri: string) {
      let href = ''
      if (nativeUrl) {
        href = CoreUtil.formatUniversalUrl(nativeUrl, uri, name)
      } else if (universalUrl) {
        href = CoreUtil.formatNativeUrl(universalUrl, uri, name)
      }
      CoreUtil.openHref(href, '_self')
    }

    if (standaloneUri) {
      onRedirect(standaloneUri)
    } else {
      onRedirect(pairingUri)
    }
  },

  handleAndroidLinking() {
    const { standaloneUri } = OptionsCtrl.state
    const { pairingUri } = WcConnectionCtrl.state

    if (standaloneUri) {
      CoreUtil.setWalletConnectAndroidDeepLink(standaloneUri)
      CoreUtil.openHref(standaloneUri, '_self')
    } else {
      CoreUtil.setWalletConnectAndroidDeepLink(pairingUri)
      CoreUtil.openHref(pairingUri, '_self')
    }
  },

  async handleUriCopy() {
    const { standaloneUri } = OptionsCtrl.state
    const { pairingUri } = WcConnectionCtrl.state
    if (standaloneUri) {
      await navigator.clipboard.writeText(standaloneUri)
    } else {
      await navigator.clipboard.writeText(pairingUri)
    }
    ToastCtrl.openToast('Link copied', 'success')
  },

  async handleConnectorConnection(id: string, onError?: () => void) {
    try {
      const { selectedChain } = OptionsCtrl.state
      await ClientCtrl.client().connectConnector(id, selectedChain?.id)
      ModalCtrl.close()
    } catch (err) {
      console.error(err)
      if (onError) {
        onError()
      } else {
        ToastCtrl.openToast(UiUtil.getErrorMessage(err), 'error')
      }
    }
  },

  getCustomImageUrls() {
    const { walletImages } = ConfigCtrl.state
    const walletUrls = Object.values(walletImages ?? {})

    return Object.values(walletUrls)
  },

  truncate(value: string, strLen = 8) {
    if (value.length <= strLen) {
      return value
    }

    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
  },

  generateAvatarColors(address: string) {
    // eslint-disable-next-line require-unicode-regexp
    const seedArr = address.match(/.{1,7}/g)?.splice(0, 5)
    const colors: string[] = []

    seedArr?.forEach(seed => {
      let hash = 0
      for (let i = 0; i < seed.length; i += 1) {
        // eslint-disable-next-line no-bitwise
        hash = seed.charCodeAt(i) + ((hash << 5) - hash)
        // eslint-disable-next-line operator-assignment, no-bitwise
        hash = hash & hash
      }

      const rgb = [0, 0, 0]
      for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-bitwise
        const value = (hash >> (i * 8)) & 255
        rgb[i] = value
      }
      colors.push(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`)
    })

    const root: HTMLElement | null = document.querySelector(':root')
    if (root) {
      const variables = {
        '--wcm-color-av-1': colors[0],
        '--wcm-color-av-2': colors[1],
        '--wcm-color-av-3': colors[2],
        '--wcm-color-av-4': colors[3],
        '--wcm-color-av-5': colors[4]
      }
      Object.entries(variables).forEach(([key, val]) => root.style.setProperty(key, val))
    }
  },

  setRecentWallet(wallet: WalletData) {
    localStorage.setItem(UiUtil.WCM_RECENT_WALLET_DATA, JSON.stringify(wallet))
  },

  getRecentWallet() {
    const wallet = localStorage.getItem(UiUtil.WCM_RECENT_WALLET_DATA)
    if (wallet) {
      const json = JSON.parse(wallet)

      return json as WalletData
    }

    return undefined
  },

  caseSafeIncludes(str1: string, str2: string) {
    return str1.toUpperCase().includes(str2.toUpperCase())
  },

  openWalletExplorerUrl() {
    CoreUtil.openHref(UiUtil.EXPLORER_WALLET_URL, '_blank')
  },

  getCachedRouterWalletPlatforms() {
    const { desktop, mobile } = CoreUtil.getWalletRouterData()
    const isDesktop = Boolean(desktop?.native)
    const isWeb = Boolean(desktop?.universal)
    const isMobile = Boolean(mobile?.native) || Boolean(mobile?.universal)

    return { isDesktop, isMobile, isWeb }
  },

  goToConnectingView(wallet: WalletData) {
    RouterCtrl.setData({ Wallet: wallet })
    const isMobileDevice = CoreUtil.isMobile()
    const { isDesktop, isWeb, isMobile } = UiUtil.getCachedRouterWalletPlatforms()

    // Mobile
    if (isMobileDevice) {
      if (isMobile) {
        RouterCtrl.push('MobileConnecting')
      } else if (isWeb) {
        RouterCtrl.push('WebConnecting')
      } else {
        RouterCtrl.push('InstallWallet')
      }
    }

    // Desktop
    else if (isDesktop) {
      RouterCtrl.push('DesktopConnecting')
    } else if (isWeb) {
      RouterCtrl.push('WebConnecting')
    } else if (isMobile) {
      RouterCtrl.push('MobileQrcodeConnecting')
    } else {
      RouterCtrl.push('InstallWallet')
    }
  }
}
