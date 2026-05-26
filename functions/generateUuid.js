export const generateUuid = (maxLength = 10) => {
    const options = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyz!¡#$%&";
    let uuid = "";
    for(let i=0 ; i < maxLength ; i++){
    const uuidRandom = options[Math.floor(Math.random() * options.length)];
    uuid+=uuidRandom;
    }
    return uuid;
}