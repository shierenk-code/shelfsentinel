import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import {load} from '@tensorflow-models/coco-ssd';

export async function loadLocalDetector(){
  try{await tf.setBackend('webgl');}catch{await tf.setBackend('cpu');}
  await tf.ready();
  return load({modelUrl:'/models/ssdlite_mobilenet_v2/model.json'});
}
