include $(TOPDIR)/rules.mk

PKG_NAME:=usb-wifi
PKG_VERSION:=1.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/usb-wifi
  SECTION:=gateway
  CATEGORY:=Gateway
  TITLE:=USB WiFi Auto Configuration
  DEPENDS:=+wifi-scripts +wpad-basic-mbedtls +iwinfo
endef

define Package/usb-wifi/description
  Automatically configure WiFi from WLAN.txt file on USB drive
endef

define Build/Compile
endef

define Package/usb-wifi/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/usb-wifi.sh $(1)/usr/sbin/usb-wifi.sh
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/usb-wifi.init $(1)/etc/init.d/usb-wifi
endef

$(eval $(call BuildPackage,usb-wifi))
