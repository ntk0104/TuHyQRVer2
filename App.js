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
  Animated,
  Modal,
  TextInput,
  Image,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const boldColors = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#008080",
  "#e6beff",
];

function formatVND(amount) {
  if (typeof amount !== "number") return "";
  return amount.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanData, setScanData] = useState([]);
  const [isFlipped, setIsFlipped] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [alertText, setAlertText] = useState("");
  const [apiDomain, setApiDomain] = useState("");
  const [apiConfigModalVisible, setApiConfigModalVisible] = useState(false);
  const [apiResponseModalVisible, setApiResponseModalVisible] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(10)).current;
  const scrollViewRef = useRef(null);

  // Load domain từ AsyncStorage khi khởi động
  useEffect(() => {
    const loadApiDomain = async () => {
      const savedDomain = await AsyncStorage.getItem("apiDomain");
      if (savedDomain) setApiDomain(savedDomain);
    };
    loadApiDomain();
  }, []);

  useEffect(() => {
    if (scanData.length > 0) {
      scaleAnim.setValue(1.2);
      translateYAnim.setValue(10);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
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
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("./assets/beep.mp3"),
        { shouldPlay: true }
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (error) {
      console.error("Error playing beep:", error);
    }
  };

  const playWarning = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("./assets/warning.mp3"),
        { shouldPlay: true }
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (error) {
      console.error("Error playing warning:", error);
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
    console.log("handleBarCodeScanned trigger");
    if (scanned) return;
    setScanned(true);
    const alertArr = alertText
      ?.toLowerCase()
      ?.split(",")
      .map((item) => item.toLowerCase().trim())
      .map((item) => item.split(" x ")[0])
      .filter((item) => item.length > 0);
    const isAlert =
      alertArr.includes(data.toLowerCase()) ||
      alertArr.includes(`${data}a`.toLowerCase());

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

    console.log(
      "🚀 ~ setScanData ~ calling api product with productName:",
      data
    );
    // Gọi API nếu có domain
    if (apiDomain) {
      try {
        const response = await axios.get(
          `${apiDomain}/api/product?productName=${data}`,
          {
            headers: { authorization: "kietdeptraizzz" },
          }
        );
        // console.log(
        //   "🚀 ~ handleBarCodeScanned ~ response.data:",
        //   response.data
        // );
        setApiResponse(response.data);
        setApiResponseModalVisible(true);
        setScanned(false);

        // Làm mới thời gian chờ 3s
        const timeoutId = setTimeout(() => {
          if (!scanned) setApiResponseModalVisible(false);
        }, 3000);
        // Làm sạch timeout nếu quét mã mới
        return () => clearTimeout(timeoutId);
      } catch (error) {
        setScanned(false);
        console.error("Lỗi rồi, báo admin");
        setApiResponse({ error: "Lỗi rồi, báo admin" });
        setApiResponseModalVisible(true);
        const timeoutId = setTimeout(() => {
          if (!scanned) setApiResponseModalVisible(false);
        }, 3000);
        return () => clearTimeout(timeoutId);
      }
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      setScanned(false);
    }, 500);
  };

  const removeItem = (index) => {
    setScanData((prevData) => prevData.filter((_, i) => i !== index));
  };

  const decreaseCount = (index) => {
    setScanData((prevData) => {
      let newData = [...prevData];
      if (newData[index].count > 1) newData[index].count -= 1;
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

  const saveApiDomain = async () => {
    await AsyncStorage.setItem("apiDomain", apiDomain);
    setApiConfigModalVisible(false); // Tắt modal sau khi lưu
  };

  if (!permission || !permission.granted) {
    return <Text>Requesting camera permission...</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={
            scanned || modalVisible || apiConfigModalVisible
              ? undefined
              : handleBarCodeScanned
          }
        />
      </View>
      <Animated.View
        style={[
          styles.listContainer,
          isFlipped && { transform: [{ rotate: "180deg" }] },
        ]}
      >
        <ScrollView ref={scrollViewRef} style={styles.scrollView}>
          {scanData.map((item, index) => {
            const isLatest = index === scanData.length - 1;
            return (
              <Animated.View
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
              </Animated.View>
            );
          })}
        </ScrollView>
      </Animated.View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => setIsFlipped(!isFlipped)}
          style={styles.flipButton}
        >
          <Text style={styles.copyText}>Xoay 180°</Text>
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
        <TouchableOpacity
          style={styles.apiConfigButton}
          onPress={() => setApiConfigModalVisible(true)}
        >
          <Text style={styles.copyText}>Cấu hình API</Text>
        </TouchableOpacity>
      </View>

      {/* Modal DS Chú Ý */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              isFlipped && { transform: [{ rotate: "180deg" }] },
            ]}
          >
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
              Danh sách mã chú ý ví dụ: GH10.234A,NHAN.1A,...
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
          </Animated.View>
        </View>
      </Modal>

      {/* Modal Cấu hình API */}
      <Modal visible={apiConfigModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              isFlipped && { transform: [{ rotate: "180deg" }] },
            ]}
          >
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
              Nhập domain API (ví dụ: https://108e3f895b32.ngrok-free.app)
            </Text>
            <TextInput
              style={styles.textArea}
              value={apiDomain}
              onChangeText={setApiDomain}
              placeholder="Nhập domain API"
            />
            <TouchableOpacity onPress={saveApiDomain} style={styles.copyButton}>
              <Text style={styles.copyText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal hiển thị API Response */}
      <Modal
        visible={apiResponseModalVisible}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.responseModalContent,
              isFlipped && { transform: [{ rotate: "180deg" }] },
            ]}
          >
            {apiResponse && (
              <>
                <Image
                  source={{
                    uri: apiResponse.base64,
                  }}
                  style={styles.responseImage}
                  resizeMode="contain"
                />
                <Text style={styles.responseText}>
                  {apiResponse.productName || "Unknown Product"} - Giá:{" "}
                  {formatVND(apiResponse.price)}
                </Text>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f4" },
  cameraContainer: { flex: 5, borderBottomWidth: 2, borderColor: "#ccc" },
  camera: { flex: 1 },
  listContainer: { flex: 3, backgroundColor: "#fff", padding: 10 },
  scrollView: { flex: 1 },
  latestScan: { fontWeight: "bold", color: "green", fontSize: 22 },
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
  flipButton: { backgroundColor: "green", padding: 15, borderRadius: 10 },
  showAlertModalBtn: { backgroundColor: "pink", padding: 15, borderRadius: 10 },
  apiConfigButton: {
    backgroundColor: "#ff9800",
    padding: 15,
    borderRadius: 10,
  },
  copyText: { color: "#fff", fontSize: 18 },
  scanItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  scanText: { fontSize: 18 },
  countText: { fontWeight: "bold", color: "hotpink" },
  iconButton: { padding: 5 },
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
  responseModalContent: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 10,
    width: "90%",
    height: 300, // Kích thước cố định để kiểm soát tỷ lệ
  },
  responseImage: {
    height: "90%", // 90% cho hình ảnh
    width: "100%",
  },
  responseText: {
    height: "10%", // 10% cho tên sản phẩm
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 5,
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
