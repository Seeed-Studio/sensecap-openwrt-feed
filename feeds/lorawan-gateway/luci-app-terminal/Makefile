#
# Copyright (C) 2024
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Terminal Menu Override
LUCI_DEPENDS:=+luci-app-ttyd
LUCI_PKGARCH:=all

PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

define Package/luci-app-terminal/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
        rm -rf /tmp/luci-*
        /etc/init.d/rpcd restart
        /etc/init.d/uhttpd restart
}
exit 0
endef

# call BuildPackage - OpenWrt buildroot signature
