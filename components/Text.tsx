import React from "react";
import { StyleSheet, Text as RNText, TextProps } from "react-native";

export const Text = (props: TextProps) => {
  const newStyle = StyleSheet.flatten([
    { fontFamily: "TitilliumWeb-Regular" },
    props.style,
  ]);
  return <RNText {...props} style={newStyle} />;
};
export default Text;
