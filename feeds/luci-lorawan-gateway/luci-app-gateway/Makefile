include $(TOPDIR)/rules.mk

LUCI_TITLE:=Gateway base
LUCI_DEPENDS:=+luci-base +luci-mod-system +luci-mod-network +luci-theme-bootstrap
PKG_MAINTAINER:= Ruiqian Tang <ruiqian.tang@seeed.cc>
PKG_LICENSE:=Apache-2.0
PKG_VERSION:=1.0
PKG_RELEASE:=1
PKG_FLAGS:=nonshared

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
