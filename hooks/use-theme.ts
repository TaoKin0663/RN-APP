import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';


type ColorScheme = 'light' | 'dark';

interface ThemeContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');
  useEffect(() => {
    // 初始化时从AsyncStorage读取保存的主题设置
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          setColorScheme(savedTheme);
        } else {
          // 如果没有保存的设置，使用系统默认设置
          const systemColorScheme = Appearance.getColorScheme();
          setColorScheme(systemColorScheme === 'dark' ? 'dark' : 'light');
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
        // 出错时使用系统默认设置
        const systemColorScheme = Appearance.getColorScheme();
        setColorScheme(systemColorScheme === 'dark' ? 'dark' : 'light');
      }
    };

    loadTheme();
  }, []);

  const handleSetColorScheme = async (scheme: ColorScheme) => {
    try {
      await AsyncStorage.setItem('theme', scheme);
      setColorScheme(scheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const toggleColorScheme = () => {
    const newScheme = colorScheme === 'light' ? 'dark' : 'light';
    handleSetColorScheme(newScheme);
  };

  return React.createElement(
    ThemeContext.Provider,
    {
      value: {
        colorScheme,
        setColorScheme: handleSetColorScheme,
        toggleColorScheme,
      }
    },
    children
  );
}

export { ThemeProvider };
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
