@echo off
echo =========================================
echo    Avvio del Server Fantaclasse in corso...
echo =========================================

echo.
echo 1. Controllo che Flask sia installato...
pip install flask --quiet

echo.
echo 2. Accensione del motore Python...
echo.
echo =========================================
echo IL SITO E' ONLINE! Vai su: http://127.0.0.1:5000
echo Tieni aperta questa finestra nera finche' vuoi usare il sito.
echo Per spegnere il sito, chiudi questa finestra.
echo =========================================
echo.

python main.py
pause
