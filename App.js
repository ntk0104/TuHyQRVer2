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
  Linking,
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
  const [healthIssueModalVisible, setHealthIssueModalVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [alertText, setAlertText] = useState("");
  const [apiDomain, setApiDomain] = useState("");
  const [branch, setBranch] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiConfigModalVisible, setApiConfigModalVisible] = useState(false);
  const [apiResponseModalVisible, setApiResponseModalVisible] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [apiHealthy, setApiHealthy] = useState(null); // null khi chưa kiểm tra
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(10)).current;
  const scrollViewRef = useRef(null);

  // Tính tổng số mã quét
  const totalScanned = scanData.reduce((sum, item) => sum + item.count, 0);

  // Load domain, branch, và apiKey từ AsyncStorage khi khởi động
  useEffect(() => {
    const loadApiConfig = async () => {
      const savedDomain = await AsyncStorage.getItem("apiDomain");
      const savedBranch = await AsyncStorage.getItem("branch");
      const savedApiKey = await AsyncStorage.getItem("apiKey");
      if (savedDomain) setApiDomain(savedDomain);
      if (savedBranch) setBranch(savedBranch);
      if (savedApiKey) setApiKey(savedApiKey);
    };
    loadApiConfig();
  }, []);

  // Kiểm tra API /health khi khởi động hoặc config thay đổi
  useEffect(() => {
    const checkApiHealth = async () => {
      if (apiDomain && branch && apiKey) {
        try {
          const response = await axios.get(`${apiDomain}/api/health`, {
            headers: { authorization: apiKey, branch: branch },
          });
          setApiHealthy(response.status === 200);
        } catch (error) {
          console.error("API /health failed:", error);
          setApiHealthy(false);
        }
      } else {
        setApiHealthy(false);
      }
    };
    checkApiHealth();
  }, [apiDomain, branch, apiKey]);

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
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
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

  const playHangChuY = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("./assets/hangchuy.mp3"),
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
    if (scanned) return;
    setScanned(true);

    // Kiểm tra lại apiHealthy khi quét
    if (apiHealthy === false) {
      setHealthIssueModalVisible(true); // Hiển thị lại modal nếu API không khỏe
      setScanned(false);
      return;
    }

    const alertArr = alertText
      ?.toLowerCase()
      ?.split(",")
      .map((item) => item.toLowerCase().trim())
      .map((item) => item.split(" x ")[0])
      .filter((item) => item.length > 0);

    setScanData((prevData) => {
      let newData = [...prevData];
      if (newData.length > 0 && newData[0]?.value === data) {
        newData[0].count += 1;
      } else {
        newData.unshift({ value: data, count: 1 });
      }
      return newData;
    });
    const isAlert =
      alertArr.includes(data.toLowerCase()) ||
      alertArr.includes(`${data}a`.toLowerCase());

    Vibration.vibrate(200);
    isAlert ? playWarning() : playBeep();
    console.log(
      "🚀 ~ setScanData ~ calling api product with productName:",
      data
    );
    let isHangChuY = false;
    if (apiDomain) {
      try {
        const response = await axios.get(
          `${apiDomain}/api/product?productName=${data}`,
          {
            headers: { authorization: apiKey, branch: branch },
          }
        );
        if (response.data.base64 && !isValidBase64Image(response.data.base64)) {
          response.data.base64 = "";
        }
        isHangChuY = response.data.isWarning;
        if (isHangChuY) {
          playHangChuY();
        }
        setApiResponse(response.data);
        setApiResponseModalVisible(true);
        setScanned(false);

        const timeoutId = setTimeout(() => {
          if (!scanned) setApiResponseModalVisible(false);
        }, 3000);
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
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      setScanned(false);
    }, 500);
  };

  const isValidBase64Image = (base64String) => {
    if (!base64String) return false;
    try {
      const base64Data = base64String.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        ""
      );
      atob(base64Data);
      return true;
    } catch (e) {
      return false;
    }
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

  const copyToClipboard = async () => {
    if (apiHealthy === false) return;
    const textToCopy = scanData
      .map((item) =>
        item.count > 1 ? `${item.value} x ${item.count}` : item.value
      )
      .join(", ");
    Clipboard.setStringAsync(textToCopy);
    alert("Copied to clipboard!");
    try {
      const response = await axios.post(
        `${apiDomain}/api/copy-scan-result`,
        { items: scanData },
        {
          headers: { authorization: apiKey, branch: branch },
        }
      );
      console.log("🚀 ~ copyToClipboard ~ response:", response);
    } catch (error) {
      console.log("🚀 ~ copyToClipboard ~ error:", error);
    }
  };

  const saveApiConfig = async () => {
    await AsyncStorage.setItem("apiDomain", apiDomain);
    await AsyncStorage.setItem("branch", branch);
    await AsyncStorage.setItem("apiKey", apiKey);
    setApiConfigModalVisible(false);
    // Kiểm tra lại API sau khi lưu config
    const checkApiHealth = async () => {
      if (apiDomain && branch && apiKey) {
        try {
          const response = await axios.get(`${apiDomain}/api/health`, {
            headers: { authorization: apiKey, branch: branch },
          });
          console.log("🚀 ~ checkApiHealth ~ response.data:", response.data);
          setApiHealthy(response.status === 200);
        } catch (error) {
          console.log("🚀 ~ checkApiHealth ~ error:", error);
          console.error("API /health failed:", error);
          setApiHealthy(false);
        }
      }
    };
    await checkApiHealth();
  };

  if (!permission || !permission.granted) {
    return <Text>Requesting camera permission...</Text>;
  }

  return (
    <View style={styles.container}>
      <Modal
        visible={healthIssueModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setHealthIssueModalVisible(false)} // Cho phép tắt modal
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: "bold", textAlign: "center" }}>
              Lỗi kết nối API!
            </Text>
            <Text style={{ textAlign: "center", marginVertical: 10 }}>
              API /health không phản hồi. Vui lòng kiểm tra cấu hình API.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setApiConfigModalVisible(true);
              }}
              style={styles.copyButton}
            >
              <Text style={styles.copyText}>Cấu hình lại API</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setHealthIssueModalVisible(false)}
              style={[
                styles.copyButton,
                { backgroundColor: "#ff4444", marginTop: 10 },
              ]}
            >
              <Text style={styles.copyText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            const isLatest = index === 0;
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
                  {isLatest ? `VỪA QUÉT ${item.value}` : item.value}
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
      <Animated.View
        style={[
          styles.scanCountContainer,
          isFlipped && { transform: [{ rotate: "180deg" }] },
        ]}
      >
        <Text style={styles.scanCountText}>SL mã quét: {totalScanned}</Text>
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
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
              Nhập chi nhánh
            </Text>
            <TextInput
              style={styles.textArea}
              value={branch}
              onChangeText={setBranch}
              placeholder="Nhập chi nhánh"
            />
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
              Nhập key
            </Text>
            <TextInput
              style={styles.textArea}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Nhập api key"
            />
            <TouchableOpacity onPress={saveApiConfig} style={styles.copyButton}>
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
                {apiResponse.base64 &&
                isValidBase64Image(apiResponse.base64) ? (
                  <Image
                    source={{
                      uri: apiResponse.base64,
                    }}
                    style={styles.responseImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Text style={styles.placeholderText}>
                      Không hiển thị được hình
                    </Text>
                  </View>
                )}
                <Text style={styles.responseText}>
                  {apiResponse.productName || "Unknown Product"} - Giá:{" "}
                  {formatVND(apiResponse.price) || "N/A"}
                </Text>
                {apiResponse.linkPostFB && (
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() =>
                      Linking.openURL(
                        apiResponse.linkPostFB // Thay bằng ID page Facebook thực tế
                      )
                    }
                  >
                    <Text style={styles.linkText}>Xem trên FB</Text>
                  </TouchableOpacity>
                )}
                {apiResponse.error && (
                  <Text style={styles.errorText}>{apiResponse.error}</Text>
                )}
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
    height: 300,
  },
  responseImage: {
    height: "90%",
    width: "100%",
  },
  responseText: {
    height: "10%",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 5,
  },
  placeholderImage: {
    height: "90%",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  placeholderText: {
    color: "#888",
    fontSize: 16,
    fontStyle: "italic",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    fontSize: 14,
    marginTop: 5,
  },
  textArea: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  scanCountContainer: {
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  scanCountText: {
    fontSize: 18,
    color: "#333",
  },
  linkButton: {
    color: "white",
    fontWeight: "bold",
    padding: 20,
    backgroundColor: "#3b5998",
    borderRadius: 5,
    marginTop: 5,
    alignSelf: "center",
  },
});
