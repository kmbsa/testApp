import React from 'react';
import { TouchableOpacity, Text, ViewStyle } from 'react-native';
import Styles from '../styles/styles';

type FormButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  additionalStyles?: ViewStyle | ViewStyle[];
};

const FormButton: React.FC<FormButtonProps> = ({
  title,
  onPress,
  disabled = false,
  additionalStyles,
}) => {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      style={[
        Styles.button,
        disabled && Styles.disabledButton,
        additionalStyles,
      ]}
    >
      <Text style={Styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
};

export default FormButton;
