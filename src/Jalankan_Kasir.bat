@off
echo Menjalankan Aplikasi Kasir Rasa Nusantara...
cd /d "C:\Users\ABIMANYU\Desktop\kasirku"
start cmd /k "npm run dev"
timeout /t 3
start http://localhost:5173/
exit