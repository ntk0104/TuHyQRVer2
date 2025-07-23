import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Vibration,
  Platform,
  NativeModules,
  Animated,
  Modal,
  TextInput,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons"; // Import icon

const boldColors = [
  "#e6194b", // đỏ tươi
  "#3cb44b", // xanh lá
  "#ffe119", // vàng đậm
  "#4363d8", // xanh dương
  "#f58231", // cam
  "#911eb4", // tím
  "#46f0f0", // xanh ngọc
  "#f032e6", // hồng cánh sen
  "#008080", // teal đậm
  "#e6beff", // tím nhạt nổi
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanData, setScanData] = useState(() => []);
  const [isFlipped, setIsFlipped] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [alertText, setAlertText] = useState(""); // text nhập vào textarea
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(10)).current;
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (scanData.length > 0) {
      // Reset trước khi animate
      scaleAnim.setValue(1.2);
      translateYAnim.setValue(10);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [scanData]);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [scanData.length]);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const getRandomColor = () => {
    return boldColors[Math.floor(Math.random() * boldColors.length)];
  };

  const playBeep = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require("./assets/beep.mp3"),
      { shouldPlay: true }
    );
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync(); // ⚠️ rất quan trọng
      }
    });
  };

  const playWarning = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require("./assets/warning.mp3"), // bạn cần thêm file này
      { shouldPlay: true }
    );
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync(); // ⚠️ rất quan trọng
      }
    });
  };

  const handleBarCodeScanned = (result) => {
    if (scanned) return;
    const data = result.data; // Loại bỏ kiểu dữ liệu của TypeScript
    setScanned(true);
    const alertArr = alertText
      ?.toLowerCase()
      ?.split(",") // tách từng phần
      .map((item) => item.toLowerCase().trim()) // viết thường + loại bỏ khoảng trắng
      .map((item) => item.split(" x ")[0]) // bỏ phần " x số lượng" nếu có
      .filter((item) => item.length > 0); // loại bỏ item rỗng nếu có
    const isAlert =
      alertArr.includes(data.toLowerCase()) ||
      alertArr.includes(`${data}a`.toLowerCase());

    // Rung và phát âm thanh beep
    Vibration.vibrate(200);
    isAlert ? playWarning() : playBeep();

    setScanData((prevData) => {
      let newData = [...prevData];
      if (newData.length > 0 && newData[newData.length - 1]?.value === data) {
        newData[newData.length - 1].count += 1;
      } else {
        newData.push({ value: data, count: 1 });
      }
      return newData;
    });
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      setScanned(false); // Mở lại scan sau 1 giây
    }, 500);
  };

  const removeItem = (index) => {
    setScanData((prevData) => prevData.filter((_, i) => i !== index));
  };

  const decreaseCount = (index) => {
    setScanData((prevData) => {
      let newData = [...prevData];
      if (newData[index].count > 1) {
        newData[index].count -= 1;
      }
      return newData;
    });
  };

  const copyToClipboard = () => {
    const textToCopy = scanData
      .map((item) =>
        item.count > 1 ? `${item.value} x ${item.count}` : item.value
      )
      .join(", ");
    Clipboard.setStringAsync(textToCopy);
    alert("Copied to clipboard!");
  };

  if (!permission || !permission.granted) {
    return <Text>Requesting camera permission...</Text>;
  }
  return (
    <View style={styles.container}>
      {/* Phần 1: Camera Scanner (50%) */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={
            scanned || modalVisible ? undefined : handleBarCodeScanned
          }
        />
      </View>

      {/* Phần 2: Danh sách QR đã scan (30%) */}
      <View
        style={[
          styles.listContainer,
          isFlipped && { transform: [{ rotate: "180deg" }] },
        ]}
      >
        <ScrollView ref={scrollViewRef} style={styles.scrollView}>
          {scanData.map((item, index) => {
            const isLatest = index === scanData.length - 1;
            const Wrapper = isLatest ? Animated.View : View;
            return (
              <Wrapper
                key={index}
                style={[
                  styles.scanItem,
                  isLatest && { transform: [{ scale: scaleAnim }] },
                ]}
              >
                <Text
                  style={[
                    styles.scanText,
                    isLatest &&
                      styles.latestScan && {
                        backgroundColor: getRandomColor(),
                      },
                  ]}
                >
                  {item.value}
                  {item.count > 1 && (
                    <Text style={styles.countText}> x {item.count}</Text>
                  )}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    item.count > 1 ? decreaseCount(index) : removeItem(index)
                  }
                  style={styles.iconButton}
                >
                  <Ionicons
                    name={item.count > 1 ? "remove-circle" : "trash"}
                    size={24}
                    color={item.count > 1 ? "orange" : "red"}
                  />
                </TouchableOpacity>
              </Wrapper>
            );
          })}
        </ScrollView>
      </View>

      {/* Phần 3: Nút Copy (20%) */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => setIsFlipped(!isFlipped)}
          style={styles.flipButton}
        >
          <Text style={styles.copyText}>
            {isFlipped ? "Để ngược lại" : "Xoay 180°"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
          <Text style={styles.copyText}>COPY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.showAlertModalBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.copyText}>DS Chú Ý</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
              Danh sách mã chú ý ví dụ: GH10.234A,NHAN.1A,..
            </Text>
            <TextInput
              style={styles.textArea}
              multiline
              value={alertText}
              onChangeText={setAlertText}
              placeholder="Nhập các mã cần cảnh báo theo cú pháp: GH10.234A,NHAN.1A hoặc GH10.234A x 5,NHAN.1A ... lưu ý khoảng trắng nhé"
            />
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.copyButton}
            >
              <Text style={styles.copyText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f4f4",
  },
  cameraContainer: {
    flex: 5,
    borderBottomWidth: 2,
    borderColor: "#ccc",
  },
  camera: {
    flex: 1,
  },
  listContainer: {
    flex: 3,
    backgroundColor: "#fff",
    padding: 10,
  },
  scrollView: {
    flex: 1,
  },
  latestScan: {
    fontWeight: "bold",
    color: "green",
    fontSize: 22,
  },
  buttonContainer: {
    flex: 2,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  copyButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    marginLeft: 10,
    marginRight: 10,
  },
  flipButton: {
    backgroundColor: "green",
    padding: 15,
    borderRadius: 10,
  },
  showAlertModalBtn: {
    backgroundColor: "pink",
    padding: 15,
    borderRadius: 10,
  },
  copyText: {
    color: "#fff",
    fontSize: 18,
  },
  scanItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%", // Đảm bảo full dòng
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  scanText: {
    fontSize: 18,
  },
  countText: {
    fontWeight: "bold",
    color: "hotpink", // SL x in hồng, in đậm
  },
  iconButton: {
    padding: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "90%",
  },
  textArea: {
    height: 150,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    textAlignVertical: "top",
    marginBottom: 20,
  },
});
