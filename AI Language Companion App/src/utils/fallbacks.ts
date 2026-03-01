export const FALLBACKS = {
  inference_error:           "Hmm, something went wrong on my end. Try again? 🔄",
  inference_slow:            "I'm thinking a bit longer than usual... hang on.",
  camera_no_text:            "Couldn't detect any text. Try getting closer or improving the lighting!",
  camera_empty_ocr:          "The image came through but I couldn't read any text. Try a clearer shot.",
  unsupported_script:        "I can see there's text here, but I don't recognise the script. Try a different image.",
  model_loading:             "Loading your AI companion... this only happens once.",
  model_not_downloaded:      "The AI model isn't downloaded yet. Connect to wifi and I'll grab it for you.",
  low_memory:                "Your device is running low on memory. Try closing other apps and relaunching.",
  json_parse_failed:         "Got a response but couldn't read it properly. Retrying...",
  dialect_unknown:           "I don't have specific dialect info for this region, but I'll do my best!",
  pronunciation_unavailable: "Voice playback isn't available in your browser.",
  location_failed:           "Couldn't detect your location. You can set it manually.",
  webgpu_unsupported:        "Your browser doesn't support on-device AI. Try Chrome 113+ or Edge 113+.",
  stt_unsupported:           "Voice input isn't supported in this browser. Try Chrome.",
} as const;

export type FallbackKey = keyof typeof FALLBACKS;
