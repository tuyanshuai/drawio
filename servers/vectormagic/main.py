#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VectorMagic - PNG 转 SVG 工具
主程序入口
"""

import sys
from PySide6.QtWidgets import QApplication
from ui.main_window import MainWindow

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("VectorMagic")
    app.setOrganizationName("VectorMagic")
    
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()

