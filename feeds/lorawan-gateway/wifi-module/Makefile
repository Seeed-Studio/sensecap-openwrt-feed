include $(TOPDIR)/rules.mk

PKG_NAME:=wifi-module
PKG_VERSION:=1.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/wifi-module
  SECTION:=gateway
  CATEGORY:=Gateway
  TITLE:=WiFi Module Auto Configuration
  DEPENDS:=+wifi-scripts +wpad-basic-mbedtls +iwinfo
endef

define Package/wifi-module/description
  Automatically configure WiFi with default AP or from WLAN.txt file on USB drive
endef

define Build/Compile
endef

define Package/wifi-module/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/wifi-module.sh $(1)/usr/sbin/wifi-module.sh
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/wifi-module.init $(1)/etc/init.d/wifi-module
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/66_wifi_init $(1)/etc/uci-defaults/66_wifi_init
endef

$(eval $(call BuildPackage,wifi-module))
