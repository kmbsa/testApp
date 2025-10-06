import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';

type DropdownItem = {
  label: string;
  value: string;
  disabled?: boolean;
};

type FormDropdownProps = {
  data: DropdownItem[];
  onValueChange?: (value: string) => void;
  value?: string | null;
  placeholder?: string;
  label?: string;
};

const DropdownComponent: React.FC<FormDropdownProps> = ({
  data,
  onValueChange,
  value: controlledValue,
  placeholder = 'Select item',
}) => {
  const [internalValue, setInternalValue] = useState<string | null>(null);
  const [isFocus, setIsFocus] = useState(false);

  // Use controlled value if provided, otherwise fallback to internal state
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = (item: DropdownItem) => {
    if (controlledValue === undefined) {
      setInternalValue(item.value);
    }
    onValueChange?.(item.value); // Notify parent
    setIsFocus(false);
  };

  return (
    <View style={styles.container}>
      <Dropdown
        style={[styles.dropdown, isFocus && { borderColor: '#F4D03F' }]}
        placeholderStyle={styles.placeholderStyle}
        selectedTextStyle={styles.selectedTextStyle}
        inputSearchStyle={styles.inputSearchStyle}
        iconStyle={styles.iconStyle}
        data={data}
        search
        maxHeight={300}
        labelField="label"
        valueField="value"
        placeholder={!isFocus ? placeholder : '...'}
        searchPlaceholder="Search..."
        value={value}
        onFocus={() => setIsFocus(true)}
        onBlur={() => setIsFocus(false)}
        onChange={handleChange}
      />
    </View>
  );
};

export default DropdownComponent;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#3D550C',
    padding: 0,
    marginBottom: 15,
  },
  dropdown: {
    height: 50,
    borderColor: 'gray',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: 'white',
  },
  icon: {
    marginRight: 5,
  },
  label: {
    position: 'absolute',
    backgroundColor: 'white',
    left: 22,
    top: 8,
    zIndex: 999,
    paddingHorizontal: 8,
    fontSize: 20,
  },
  placeholderStyle: {
    fontSize: 20,
    color: '#8b8b8bff',
  },
  selectedTextStyle: {
    fontSize: 20,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 20,
  },
});
