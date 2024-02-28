from PIL import Image
from PIL.PngImagePlugin import PngImageFile, PngInfo
import requests
import os
import sys

data = sys.argv[1]
#Sample Pillow PNG Metadata Program
#Baked with love by KG

img_path = (f'https://berry2.relayx.com/{data}') #can use any image file but this will make a png
s = img_path.split("/")
name = s[3] #gets filename
savedpath=f'{os.getcwd()}/mymodules/img/{name}.png'

with open(savedpath, 'wb') as handle:
    response = requests.get(img_path, stream=True)

    if not response.ok:
        print(response)

    for block in response.iter_content(1024):
        if not block:
            break

        handle.write(block)



#prints the image metadata after load
img = PngImageFile(savedpath)
x = img.text
print(x)
os.remove(savedpath)
#
#for idx, i in enumerate(x):
#    print(i+" "+x.get(i))


