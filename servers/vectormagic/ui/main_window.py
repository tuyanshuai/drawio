#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
主窗口界面
"""

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QFileDialog, QLabel, QMessageBox, QProgressBar, QGroupBox,
    QComboBox, QMenuBar, QMenu, QStatusBar
)
from PySide6.QtCore import Qt, Signal, QThread
from PySide6.QtGui import QPixmap, QImage, QAction
import os

from core.converter import PNGToSVGConverter


class ConversionThread(QThread):
    """转换线程，避免阻塞 UI"""
    finished = Signal(bool, str)
    progress = Signal(int)
    
    def __init__(self, converter, png_path, svg_path):
        super().__init__()
        self.converter = converter
        self.png_path = png_path
        self.svg_path = svg_path
    
    def run(self):
        try:
            self.progress.emit(20)
            success = self.converter.convert(self.png_path, self.svg_path)
            self.progress.emit(100)
            if success:
                self.finished.emit(True, f"转换成功！\n保存至: {self.svg_path}")
            else:
                self.finished.emit(False, "转换失败，请检查文件格式和路径。")
        except Exception as e:
            self.finished.emit(False, f"转换出错: {str(e)}")


class MainWindow(QMainWindow):
    """主窗口类"""
    
    def __init__(self):
        super().__init__()
        self.png_path = None
        self.converter = PNGToSVGConverter()
        self.init_ui()
        self.init_menu_bar()
        self.init_status_bar()
    
    def init_ui(self):
        """初始化用户界面"""
        self.setWindowTitle("VectorMagic - PNG 转 SVG")
        self.setGeometry(100, 100, 900, 700)
        
        # 中央部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # 主布局
        main_layout = QVBoxLayout()
        central_widget.setLayout(main_layout)
        
        # 标题
        title_label = QLabel("VectorMagic - PNG 转 SVG 工具")
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setStyleSheet("""
            font-size: 24px;
            font-weight: bold;
            padding: 20px;
            color: #2c3e50;
        """)
        main_layout.addWidget(title_label)
        
        # 文件选择区域
        file_group = QGroupBox("文件选择")
        file_layout = QHBoxLayout()
        
        self.file_label = QLabel("未选择文件")
        self.file_label.setStyleSheet("padding: 10px;")
        
        self.select_btn = QPushButton("选择 PNG 文件")
        self.select_btn.setStyleSheet("""
            QPushButton {
                background-color: #3498db;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #2980b9;
            }
            QPushButton:pressed {
                background-color: #21618c;
            }
        """)
        self.select_btn.clicked.connect(self.select_png_file)
        
        file_layout.addWidget(self.file_label)
        file_layout.addWidget(self.select_btn)
        file_group.setLayout(file_layout)
        main_layout.addWidget(file_group)
        
        # 预览区域
        preview_group = QGroupBox("图片预览")
        preview_layout = QVBoxLayout()
        
        self.preview_label = QLabel("预览区域")
        self.preview_label.setAlignment(Qt.AlignCenter)
        self.preview_label.setMinimumHeight(300)
        self.preview_label.setStyleSheet("""
            QLabel {
                border: 2px dashed #bdc3c7;
                background-color: #ecf0f1;
                border-radius: 5px;
            }
        """)
        preview_layout.addWidget(self.preview_label)
        preview_group.setLayout(preview_layout)
        main_layout.addWidget(preview_group)
        
        # 设置区域
        settings_group = QGroupBox("转换设置")
        settings_layout = QHBoxLayout()
        
        settings_label = QLabel("颜色模式:")
        self.color_mode_combo = QComboBox()
        self.color_mode_combo.addItems(["彩色", "灰度", "二值化"])
        self.color_mode_combo.setCurrentIndex(0)
        self.color_mode_combo.currentIndexChanged.connect(self.on_color_mode_changed)
        self.color_mode_combo.setStyleSheet("""
            QComboBox {
                padding: 5px 10px;
                border: 1px solid #bdc3c7;
                border-radius: 3px;
                background-color: white;
            }
            QComboBox:hover {
                border-color: #3498db;
            }
        """)
        
        settings_layout.addWidget(settings_label)
        settings_layout.addWidget(self.color_mode_combo)
        settings_layout.addStretch()
        settings_group.setLayout(settings_layout)
        main_layout.addWidget(settings_group)
        
        # 转换控制区域
        control_group = QGroupBox("转换控制")
        control_layout = QVBoxLayout()
        
        # 进度条
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                border: 2px solid #bdc3c7;
                border-radius: 5px;
                text-align: center;
                height: 25px;
            }
            QProgressBar::chunk {
                background-color: #3498db;
                border-radius: 3px;
            }
        """)
        control_layout.addWidget(self.progress_bar)
        
        # 转换按钮
        button_layout = QHBoxLayout()
        
        self.convert_btn = QPushButton("转换为 SVG")
        self.convert_btn.setEnabled(False)
        self.convert_btn.setStyleSheet("""
            QPushButton {
                background-color: #27ae60;
                color: white;
                padding: 15px 30px;
                border: none;
                border-radius: 5px;
                font-size: 16px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #229954;
            }
            QPushButton:pressed {
                background-color: #1e8449;
            }
            QPushButton:disabled {
                background-color: #95a5a6;
            }
        """)
        self.convert_btn.clicked.connect(self.convert_to_svg)
        
        button_layout.addStretch()
        button_layout.addWidget(self.convert_btn)
        button_layout.addStretch()
        
        control_layout.addLayout(button_layout)
        control_group.setLayout(control_layout)
        main_layout.addWidget(control_group)
        
        main_layout.addStretch()
    
    def init_menu_bar(self):
        """初始化菜单栏"""
        menubar = self.menuBar()
        
        # 文件菜单
        file_menu = menubar.addMenu("文件")
        
        open_action = QAction("打开 PNG 文件", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self.select_png_file)
        file_menu.addAction(open_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # 帮助菜单
        help_menu = menubar.addMenu("帮助")
        
        about_action = QAction("关于", self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
    
    def init_status_bar(self):
        """初始化状态栏"""
        self.statusBar().showMessage("就绪")
    
    def on_color_mode_changed(self, index):
        """颜色模式改变"""
        modes = ["color", "grayscale", "binary"]
        self.converter.set_color_mode(modes[index])
        self.statusBar().showMessage(f"已切换到{self.color_mode_combo.currentText()}模式")
    
    def show_about(self):
        """显示关于对话框"""
        QMessageBox.about(
            self,
            "关于 VectorMagic",
            "<h2>VectorMagic</h2>"
            "<p>PNG 转 SVG 工具</p>"
            "<p>版本: 1.0.0</p>"
            "<p>一个基于 Qt 的位图转矢量图工具</p>"
            "<p>支持彩色、灰度和二值化模式转换</p>"
        )
    
    def select_png_file(self):
        """选择 PNG 文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "选择 PNG 文件",
            "",
            "PNG 图片 (*.png);;所有文件 (*.*)"
        )
        
        if file_path:
            self.png_path = file_path
            self.file_label.setText(os.path.basename(file_path))
            self.load_preview(file_path)
            self.convert_btn.setEnabled(True)
            self.statusBar().showMessage(f"已加载: {os.path.basename(file_path)}")
    
    def load_preview(self, file_path):
        """加载预览图片"""
        try:
            pixmap = QPixmap(file_path)
            if not pixmap.isNull():
                # 缩放以适应预览区域
                scaled_pixmap = pixmap.scaled(
                    self.preview_label.size(),
                    Qt.KeepAspectRatio,
                    Qt.SmoothTransformation
                )
                self.preview_label.setPixmap(scaled_pixmap)
            else:
                self.preview_label.setText("无法加载图片")
        except Exception as e:
            QMessageBox.warning(self, "错误", f"加载预览失败: {str(e)}")
    
    def resizeEvent(self, event):
        """窗口大小改变时重新加载预览"""
        super().resizeEvent(event)
        if self.png_path:
            self.load_preview(self.png_path)
    
    def convert_to_svg(self):
        """转换为 SVG"""
        if not self.png_path:
            QMessageBox.warning(self, "警告", "请先选择 PNG 文件")
            return
        
        # 选择保存位置
        svg_path, _ = QFileDialog.getSaveFileName(
            self,
            "保存 SVG 文件",
            os.path.splitext(os.path.basename(self.png_path))[0] + ".svg",
            "SVG 文件 (*.svg);;所有文件 (*.*)"
        )
        
        if not svg_path:
            return
        
        # 显示进度条
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.convert_btn.setEnabled(False)
        self.select_btn.setEnabled(False)
        self.statusBar().showMessage("正在转换...")
        
        # 创建转换线程
        self.conversion_thread = ConversionThread(
            self.converter,
            self.png_path,
            svg_path
        )
        self.conversion_thread.progress.connect(self.progress_bar.setValue)
        self.conversion_thread.finished.connect(self.on_conversion_finished)
        self.conversion_thread.start()
    
    def on_conversion_finished(self, success, message):
        """转换完成回调"""
        self.progress_bar.setVisible(False)
        self.convert_btn.setEnabled(True)
        self.select_btn.setEnabled(True)
        
        if success:
            QMessageBox.information(self, "成功", message)
            self.statusBar().showMessage("转换完成！")
        else:
            QMessageBox.critical(self, "失败", message)
            self.statusBar().showMessage("转换失败")

