include $(TOPDIR)/rules.mk

PKG_NAME:=lora
PKG_VERSION:=1.0
PKG_RELEASE:=1

PKG_MAINTAINER:=ruiqian tang <ruiqian.tang@seeed.cc>
PKG_LICENSE:=Apache-2.0

include $(INCLUDE_DIR)/package.mk

define Package/lora
	SECTION:=gateway
	CATEGORY:=Gateway
	TITLE:=LoRa Configuration
	DEPENDS:= +chirpstack-concentratord +chirpstack-udp-forwarder-single +basicstation
endef

define Package/lora/description
	Provides configuration files for LoRa Configuration.
endef

define Package/lora/conffiles
	/etc/config/lora
endef

define Package/lora/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/lora.config $(1)/etc/config/lora
	$(INSTALL_CONF) ./files/basicstation.config $(1)/etc/config/basicstation
endef

define Build/Compile
	# Nothing to do
endef

$(eval $(call BuildPackage,lora))