include $(TOPDIR)/rules.mk

PKG_NAME:=chirpstack-gateway-bridge
PKG_VERSION:=4.0.11
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/brocaar/chirpstack-gateway-bridge/tar.gz/v$(PKG_VERSION)
PKG_HASH:=skip

PKG_MAINTAINER:=ChirpStack Community <info@chirpstack.io>
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE

PKG_BUILD_DEPENDS:=golang/host
PKG_BUILD_PARALLEL:=1
PKG_USE_MIPS16:=0

GO_PKG:=github.com/brocaar/chirpstack-gateway-bridge
GO_PKG_BUILD_PKG:=github.com/brocaar/chirpstack-gateway-bridge/cmd/chirpstack-gateway-bridge

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

define Package/chirpstack-gateway-bridge
	SECTION:=gateway
	CATEGORY:=Gateway
	TITLE:=ChirpStack Gateway Bridge
	URL:=https://www.chirpstack.io/
	DEPENDS:=$(GO_ARCH_DEPENDS)
	CONFLICTS:=chirpstack
endef

define Package/chirpstack-gateway-bridge/description
	ChirpStack Gateway Bridge is a service which converts LoRa®
	Packet Forwarder protocols into a ChirpStack Network Server
	common data-format (JSON and Protobuf).
endef

define Package/chirpstack-gateway-bridge/conffiles
/etc/config/chirpstack-gateway-bridge
endef

define Package/chirpstack-gateway-bridge/install
	$(call GoPackage/Package/Install/Bin,$(1))

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/chirpstack-gateway-bridge.init $(1)/etc/init.d/chirpstack-gateway-bridge

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/chirpstack-gateway-bridge.toml $(1)/etc/config/chirpstack-gateway-bridge
	${INSTALL_CONF} ./files/chirpstack.config $(1)/etc/config/chirpstack
endef

$(eval $(call GoBinPackage,chirpstack-gateway-bridge))
$(eval $(call BuildPackage,chirpstack-gateway-bridge))
