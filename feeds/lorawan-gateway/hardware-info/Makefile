include $(TOPDIR)/rules.mk

PKG_NAME:=hardware-info
PKG_VERSION:=1.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/hardware-info
  SECTION:=gateway
  CATEGORY:=Gateway
  TITLE:=Hardware Info Reader
endef

define Package/hardware-info/description
  Reads hardware info from EEPROM and populates /etc/deviceinfo
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Package/hardware-info/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/hardware_info $(1)/usr/bin/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/hardware_info.init $(1)/etc/init.d/hardware_info
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/99-fix-distfeeds $(1)/etc/uci-defaults/99-fix-distfeeds
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DATA) ./files/etc/config/hardware $(1)/etc/config/hardware
endef

$(eval $(call BuildPackage,hardware-info))
