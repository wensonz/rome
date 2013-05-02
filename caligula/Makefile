
BUILD = build
TARGET = $(BUILD)/caligula

SRC = src
BIN = $(SRC)/bin
LIB = $(SRC)/lib
CONF = $(SRC)/config

target:
	@mkdir -p $(TARGET)
	
caligula: target
	@cp -r $(BIN) $(TARGET)
	@cp -r $(LIB) $(TARGET)
	@cp -r $(CONF) $(TARGET)
	
clean:
	@rm -rf $(BUILD)

