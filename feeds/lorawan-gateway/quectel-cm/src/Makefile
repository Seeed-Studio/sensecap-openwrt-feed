ifndef CFLAGS
CFLAGS = -O2 -g -Wall
endif

ifndef LDFLAGS
LDFLAGS =
endif

LIBS=-lpthread -ldl

QL_CM_SRC = QmiWwanCM.o GobiNetCM.o main.o QCQMUX.o QMIThread.o util.o qmap_bridge_mode.o mbim-cm.o device.o atc.o atchannel.o at_tok.o udhcpc.o

all: quectel-CM

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<

quectel-CM: $(QL_CM_SRC)
	$(CC) $(LDFLAGS) -o $@ $^ $(LIBS)

clean:
	rm -rf *.o quectel-CM

.PHONY: all clean
